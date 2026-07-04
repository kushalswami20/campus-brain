"""Study-tools endpoints: summary, flashcards, quiz."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import StudyServiceDep, verify_service_key
from app.schemas.study import (
    FlashcardsResponse,
    QuizResponse,
    StudyRequest,
    SummaryResponse,
)

router = APIRouter(
    prefix="/v1/study",
    tags=["study"],
    dependencies=[Depends(verify_service_key)],
)


@router.post("/summary", response_model=SummaryResponse)
def summary(request: StudyRequest, service: StudyServiceDep) -> SummaryResponse:
    return service.summarize(request)


@router.post("/flashcards", response_model=FlashcardsResponse)
def flashcards(
    request: StudyRequest, service: StudyServiceDep
) -> FlashcardsResponse:
    return service.flashcards(request)


@router.post("/quiz", response_model=QuizResponse)
def quiz(request: StudyRequest, service: StudyServiceDep) -> QuizResponse:
    return service.quiz(request)
