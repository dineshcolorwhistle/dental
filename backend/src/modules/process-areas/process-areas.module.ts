import { Module } from '@nestjs/common';
import { ProcessAreasService } from './process-areas.service';
import { ProcessAreasController } from './process-areas.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProcessAreasController],
  providers: [ProcessAreasService],
  exports: [ProcessAreasService],
})
export class ProcessAreasModule {}
