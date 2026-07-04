import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateDto {
  @ApiPropertyOptional({ description: 'Topic to focus on (optional).' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  topic?: string;

  @ApiPropertyOptional({ default: 8, minimum: 1, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  count?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;
}

class FlashcardInput {
  @ApiProperty()
  @IsString()
  question!: string;

  @ApiProperty()
  @IsString()
  answer!: string;
}

export class SaveFlashcardsDto {
  @ApiProperty({ type: [FlashcardInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlashcardInput)
  flashcards!: FlashcardInput[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;
}

export class ReviewFlashcardDto {
  @ApiProperty({
    minimum: 0,
    maximum: 5,
    description: 'Recall quality: 0 (forgot) to 5 (perfect).',
  })
  @IsInt()
  @Min(0)
  @Max(5)
  quality!: number;
}

class QuizAnswerInput {
  @ApiProperty()
  @IsInt()
  questionIndex!: number;

  @ApiProperty()
  @IsInt()
  selectedIndex!: number;
}

export class SubmitQuizDto {
  @ApiProperty({ type: [Object], description: 'The generated questions.' })
  @IsArray()
  questions!: unknown[];

  @ApiProperty({ type: [QuizAnswerInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerInput)
  answers!: QuizAnswerInput[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;
}
