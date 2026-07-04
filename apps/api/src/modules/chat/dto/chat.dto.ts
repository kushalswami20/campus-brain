import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChatDto {
  @ApiPropertyOptional({ example: 'Operating systems revision' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class UpdateChatDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Explain the deadlock Coffman conditions.' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}

export class ListChatsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ description: 'Full-text search over chat titles.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
