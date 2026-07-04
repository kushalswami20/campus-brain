import { Injectable, NotFoundException } from '@nestjs/common';
import { Flashcard, Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { StudyRepository } from './study.repository';
import {
  GenerateDto,
  ReviewFlashcardDto,
  SaveFlashcardsDto,
  SubmitQuizDto,
} from './dto/study.dto';

interface QuizQuestionShape {
  answerIndex?: number;
  answer_index?: number;
}

@Injectable()
export class StudyService {
  constructor(
    private readonly ai: AiService,
    private readonly repo: StudyRepository,
  ) {}

  summarize(userId: string, dto: GenerateDto, requestId: string) {
    return this.ai.summarize({
      requestId,
      userId,
      topic: dto.topic,
      count: dto.count,
    });
  }

  generateFlashcards(userId: string, dto: GenerateDto, requestId: string) {
    return this.ai.generateFlashcards({
      requestId,
      userId,
      topic: dto.topic,
      count: dto.count,
    });
  }

  generateQuiz(userId: string, dto: GenerateDto, requestId: string) {
    return this.ai.generateQuiz({
      requestId,
      userId,
      topic: dto.topic,
      count: dto.count,
    });
  }

  async saveFlashcards(
    userId: string,
    dto: SaveFlashcardsDto,
  ): Promise<{ saved: number }> {
    const result = await this.repo.createFlashcards(
      userId,
      dto.flashcards.map((card) => ({ ...card, subject: dto.subject })),
    );
    return { saved: result.count };
  }

  listFlashcards(userId: string, dueOnly: boolean): Promise<Flashcard[]> {
    return this.repo.listFlashcards(userId, dueOnly);
  }

  /** Apply an SM-2 spaced-repetition update after a review. */
  async reviewFlashcard(
    userId: string,
    id: string,
    dto: ReviewFlashcardDto,
  ): Promise<Flashcard> {
    const card = await this.repo.findFlashcard(id, userId);
    if (!card) throw new NotFoundException('Flashcard not found.');

    const next = StudyService.sm2(card, dto.quality);
    return this.repo.updateFlashcard(id, next);
  }

  async removeFlashcard(userId: string, id: string): Promise<void> {
    const card = await this.repo.findFlashcard(id, userId);
    if (!card) throw new NotFoundException('Flashcard not found.');
    await this.repo.softDeleteFlashcard(id);
  }

  async submitQuiz(userId: string, dto: SubmitQuizDto) {
    const total = dto.questions.length;
    let correct = 0;
    for (const answer of dto.answers) {
      const question = dto.questions[answer.questionIndex] as QuizQuestionShape;
      const correctIndex = question?.answerIndex ?? question?.answer_index;
      if (correctIndex !== undefined && correctIndex === answer.selectedIndex) {
        correct += 1;
      }
    }
    const score = total > 0 ? Math.round((correct / total) * 100) / 100 : 0;

    await this.repo.createQuizAttempt({
      userId,
      subject: dto.subject,
      questions: dto.questions as Prisma.InputJsonValue,
      answers: dto.answers as unknown as Prisma.InputJsonValue,
      score,
      totalQuestions: total,
    });
    return { score, correct, total };
  }

  listQuizAttempts(userId: string) {
    return this.repo.listQuizAttempts(userId);
  }

  /**
   * SM-2 algorithm. quality < 3 resets the schedule; otherwise the interval
   * grows by the ease factor, which itself adjusts with recall quality.
   */
  private static sm2(
    card: Flashcard,
    quality: number,
  ): Prisma.FlashcardUpdateInput {
    let ease = card.easeFactor;
    let interval: number;
    let reviewCount = card.reviewCount;

    if (quality < 3) {
      interval = 1;
      reviewCount = 0;
    } else {
      if (reviewCount === 0) interval = 1;
      else if (reviewCount === 1) interval = 6;
      else interval = Math.round(card.intervalDays * ease);
      reviewCount += 1;
    }

    ease = Math.max(
      1.3,
      ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + interval);

    return {
      easeFactor: Math.round(ease * 100) / 100,
      intervalDays: interval,
      reviewCount,
      dueAt,
    };
  }
}
