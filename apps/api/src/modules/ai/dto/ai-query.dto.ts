import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Thin debug/echo query DTO for Milestone 3 — proves the streaming path end to
 * end. The full chat contract (history, filters, persistence) arrives in M6.
 */
export class AiQueryDto {
  @ApiProperty({ example: 'Explain B+ trees.' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  query!: string;

  @ApiProperty({ required: false, description: 'Optional chat id for context.' })
  @IsOptional()
  @IsString()
  chatId?: string;
}
