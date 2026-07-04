import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StudyService } from './study.service';
import {
  GenerateDto,
  ReviewFlashcardDto,
  SaveFlashcardsDto,
  SubmitQuizDto,
} from './dto/study.dto';

@ApiTags('study')
@ApiBearerAuth()
@Controller('study')
export class StudyController {
  constructor(private readonly study: StudyService) {}

  private rid(req: Request & { id?: string }): string {
    return req.id ?? 'unknown';
  }

  @Post('summary')
  @ApiOperation({ summary: 'Generate a grounded summary of your material.' })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateDto,
    @Req() req: Request & { id?: string },
  ) {
    return this.study.summarize(user.userId, dto, this.rid(req));
  }

  @Post('flashcards/generate')
  @ApiOperation({ summary: 'Generate flashcards from your material.' })
  generateFlashcards(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateDto,
    @Req() req: Request & { id?: string },
  ) {
    return this.study.generateFlashcards(user.userId, dto, this.rid(req));
  }

  @Post('flashcards')
  @ApiOperation({ summary: 'Save flashcards to your deck.' })
  saveFlashcards(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveFlashcardsDto,
  ) {
    return this.study.saveFlashcards(user.userId, dto);
  }

  @Get('flashcards')
  @ApiOperation({ summary: 'List saved flashcards (optionally only due ones).' })
  listFlashcards(
    @CurrentUser() user: AuthenticatedUser,
    @Query('due') due?: string,
  ) {
    return this.study.listFlashcards(user.userId, due === 'true');
  }

  @Post('flashcards/:id/review')
  @ApiOperation({ summary: 'Review a flashcard (spaced repetition update).' })
  reviewFlashcard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewFlashcardDto,
  ) {
    return this.study.reviewFlashcard(user.userId, id, dto);
  }

  @Delete('flashcards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a flashcard.' })
  removeFlashcard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.study.removeFlashcard(user.userId, id);
  }

  @Post('quiz/generate')
  @ApiOperation({ summary: 'Generate a quiz from your material.' })
  generateQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateDto,
    @Req() req: Request & { id?: string },
  ) {
    return this.study.generateQuiz(user.userId, dto, this.rid(req));
  }

  @Post('quiz/submit')
  @ApiOperation({ summary: 'Submit quiz answers and record the attempt.' })
  submitQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.study.submitQuiz(user.userId, dto);
  }

  @Get('quiz/attempts')
  @ApiOperation({ summary: 'List recent quiz attempts.' })
  listAttempts(@CurrentUser() user: AuthenticatedUser) {
    return this.study.listQuizAttempts(user.userId);
  }
}
