import { Flashcard } from '@prisma/client';
import { StudyService } from './study.service';
import { StudyRepository } from './study.repository';
import type { AiService } from '../ai/ai.service';

describe('StudyService', () => {
  const baseCard = (over: Partial<Flashcard> = {}): Flashcard =>
    ({
      id: 'c1',
      userId: 'u1',
      question: 'Q',
      answer: 'A',
      subject: 'OS',
      easeFactor: 2.5,
      intervalDays: 6,
      dueAt: new Date(),
      reviewCount: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }) as Flashcard;

  const build = (card: Flashcard) => {
    const captured: { data?: Record<string, unknown> } = {};
    const repo = {
      findFlashcard: jest.fn(async () => card),
      updateFlashcard: jest.fn(async (_id: string, data: Record<string, unknown>) => {
        captured.data = data;
        return { ...card, ...data };
      }),
      createQuizAttempt: jest.fn(async () => ({})),
    } as unknown as StudyRepository;
    const service = new StudyService({} as AiService, repo);
    return { service, captured };
  };

  it('grows the interval by the ease factor on a strong recall', async () => {
    const { service, captured } = build(baseCard({ intervalDays: 6, reviewCount: 2 }));
    await service.reviewFlashcard('u1', 'c1', { quality: 5 });
    // interval = round(6 * 2.5) = 15; ease increases; reviewCount -> 3.
    expect(captured.data?.intervalDays).toBe(15);
    expect(captured.data?.reviewCount).toBe(3);
    expect(captured.data?.easeFactor as number).toBeGreaterThan(2.5);
  });

  it('resets the schedule on a failed recall', async () => {
    const { service, captured } = build(baseCard({ intervalDays: 15, reviewCount: 4 }));
    await service.reviewFlashcard('u1', 'c1', { quality: 1 });
    expect(captured.data?.intervalDays).toBe(1);
    expect(captured.data?.reviewCount).toBe(0);
    // Ease never drops below the 1.3 floor.
    expect(captured.data?.easeFactor as number).toBeGreaterThanOrEqual(1.3);
  });

  it('scores a quiz by comparing selected vs correct indices', async () => {
    const { service } = build(baseCard());
    const result = await service.submitQuiz('u1', {
      questions: [
        { answerIndex: 0 },
        { answerIndex: 2 },
        { answerIndex: 1 },
      ],
      answers: [
        { questionIndex: 0, selectedIndex: 0 }, // correct
        { questionIndex: 1, selectedIndex: 3 }, // wrong
        { questionIndex: 2, selectedIndex: 1 }, // correct
      ],
      subject: 'OS',
    });
    expect(result.correct).toBe(2);
    expect(result.total).toBe(3);
    expect(result.score).toBeCloseTo(0.67, 2);
  });
});
