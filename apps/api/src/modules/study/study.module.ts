import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';
import { StudyRepository } from './study.repository';

@Module({
  imports: [AiModule],
  controllers: [StudyController],
  providers: [StudyService, StudyRepository],
})
export class StudyModule {}
