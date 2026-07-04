import { Injectable } from '@nestjs/common';
import { Flashcard, Prisma, QuizAttempt } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';

/** Prisma access for Flashcard and QuizAttempt. */
@Injectable()
export class StudyRepository {
  constructor(private readonly prisma: PrismaService) {}

  createFlashcards(
    userId: string,
    cards: { question: string; answer: string; subject?: string }[],
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.flashcard.createMany({
      data: cards.map((card) => ({
        userId,
        question: card.question,
        answer: card.answer,
        subject: card.subject,
      })),
    });
  }

  listFlashcards(userId: string, dueOnly: boolean): Promise<Flashcard[]> {
    return this.prisma.flashcard.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(dueOnly ? { dueAt: { lte: new Date() } } : {}),
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  findFlashcard(id: string, userId: string): Promise<Flashcard | null> {
    return this.prisma.flashcard.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  updateFlashcard(
    id: string,
    data: Prisma.FlashcardUpdateInput,
  ): Promise<Flashcard> {
    return this.prisma.flashcard.update({ where: { id }, data });
  }

  async softDeleteFlashcard(id: string): Promise<void> {
    await this.prisma.flashcard.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  createQuizAttempt(input: {
    userId: string;
    subject?: string;
    questions: Prisma.InputJsonValue;
    answers: Prisma.InputJsonValue;
    score: number;
    totalQuestions: number;
  }): Promise<QuizAttempt> {
    return this.prisma.quizAttempt.create({
      data: { ...input, completedAt: new Date() },
    });
  }

  listQuizAttempts(userId: string): Promise<QuizAttempt[]> {
    return this.prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
