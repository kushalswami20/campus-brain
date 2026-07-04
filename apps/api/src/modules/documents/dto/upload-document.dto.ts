import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** Multipart form fields accompanying the uploaded file. */
export class UploadDocumentDto {
  @ApiPropertyOptional({ description: 'Overrides the filename as the title.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @ApiPropertyOptional({ description: 'Associate the document with a subject.' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class DocumentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() originalName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ enum: DocumentType }) type!: DocumentType;
  @ApiProperty() status!: string;
  @ApiProperty() chunkCount!: number;
  @ApiProperty({ nullable: true }) pageCount!: number | null;
  @ApiProperty({ nullable: true }) subjectId!: string | null;
  @ApiProperty({ nullable: true }) errorMessage!: string | null;
  @ApiProperty() createdAt!: Date;
}
