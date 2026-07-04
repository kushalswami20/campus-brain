"""LangGraph assembly of the multi-agent RAG pipeline.

Flow:
    planner → retriever → hybrid_search → reranker → reasoning →
    answer_generator → verification → citation → reflection
        ↳ retry ⇒ back to retriever (bounded by MAX_ITERATIONS)
        ↳ end   ⇒ finish

Each node is a single-responsibility agent module. The graph is compiled once
and reused; it holds no per-request state.
"""

from __future__ import annotations

from dataclasses import dataclass

from langgraph.graph import END, StateGraph

from app.services.providers.embeddings import EmbeddingProvider
from app.services.providers.keyword_index import KeywordIndex
from app.services.providers.llm import LLMProvider
from app.services.providers.vector_store import VectorStore

from .answer_generator import AnswerGeneratorAgent
from .citation import CitationAgent
from .hybrid_search import HybridSearchAgent
from .planner import PlannerAgent
from .reasoning import ReasoningAgent
from .reflection import ReflectionAgent, should_continue
from .reranker import RerankerAgent
from .retriever import RetrieverAgent
from .state import RagState
from .verification import VerificationAgent


@dataclass
class PipelineResult:
    answer: str
    grounded: bool
    citations: list[dict]
    usage: dict
    trace: list[str]
    verification: dict


class RagPipeline:
    def __init__(
        self,
        *,
        embeddings: EmbeddingProvider,
        vector_store: VectorStore,
        keyword_index: KeywordIndex,
        llm: LLMProvider,
        reranker_model: str | None = None,
    ) -> None:
        self._graph = self._build(
            embeddings, vector_store, keyword_index, llm, reranker_model
        )

    def run(
        self,
        *,
        request_id: str,
        query: str,
        filters: dict | None,
        top_k: int,
    ) -> PipelineResult:
        final: RagState = self._graph.invoke(
            {
                "request_id": request_id,
                "query": query,
                "filters": filters,
                "top_k": top_k,
                "iterations": 0,
                "trace": [],
            }
        )
        return PipelineResult(
            answer=final.get("answer", ""),
            grounded=bool(final.get("grounded", False)),
            citations=final.get("citations", []),
            usage=final.get("usage", {}),
            trace=final.get("trace", []),
            verification=final.get("verification", {}),
        )

    @staticmethod
    def _build(
        embeddings: EmbeddingProvider,
        vector_store: VectorStore,
        keyword_index: KeywordIndex,
        llm: LLMProvider,
        reranker_model: str | None,
    ):  # type: ignore[no-untyped-def]
        graph = StateGraph(RagState)

        # Node names must not collide with state keys (LangGraph constraint), so
        # the verification/reflection nodes carry an "_agent" suffix.
        graph.add_node("planner", PlannerAgent())
        graph.add_node("retriever", RetrieverAgent(embeddings, vector_store))
        graph.add_node("hybrid_search", HybridSearchAgent(keyword_index))
        graph.add_node("reranker", RerankerAgent(reranker_model))
        graph.add_node("reasoning", ReasoningAgent())
        graph.add_node("answer_generator", AnswerGeneratorAgent(llm))
        graph.add_node("verification_agent", VerificationAgent())
        graph.add_node("citation_agent", CitationAgent())
        graph.add_node("reflection_agent", ReflectionAgent())

        graph.set_entry_point("planner")
        graph.add_edge("planner", "retriever")
        graph.add_edge("retriever", "hybrid_search")
        graph.add_edge("hybrid_search", "reranker")
        graph.add_edge("reranker", "reasoning")
        graph.add_edge("reasoning", "answer_generator")
        graph.add_edge("answer_generator", "verification_agent")
        graph.add_edge("verification_agent", "citation_agent")
        graph.add_edge("citation_agent", "reflection_agent")
        graph.add_conditional_edges(
            "reflection_agent", should_continue, {"retry": "retriever", "end": END}
        )

        return graph.compile()
