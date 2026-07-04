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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { PaginatedResponse } from '@/common/dto/api-response';
import { DocumentsService } from './documents.service';
import { ListDocumentsDto } from './dto/list-documents.dto';
import {
  DocumentResponseDto,
  UploadDocumentDto,
} from './dto/upload-document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Upload a document; ingestion runs asynchronously.' })
  @ApiConsumes('multipart/form-data')
  // Memory storage: the buffer is handed to the storage provider, not written
  // to disk by Multer. The size cap is enforced again in the service.
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 30 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Req() req: Request & { id?: string },
  ): Promise<DocumentResponseDto> {
    return this.documents.upload(user.userId, file, dto, req.id ?? 'unknown');
  }

  @Get()
  @ApiOperation({ summary: 'List the current user documents.' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: ListDocumentsDto,
  ): Promise<PaginatedResponse<DocumentResponseDto>> {
    return this.documents.list(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document (including ingestion status).' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DocumentResponseDto> {
    return this.documents.getById(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a document and remove its file.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.documents.remove(user.userId, id);
  }
}
