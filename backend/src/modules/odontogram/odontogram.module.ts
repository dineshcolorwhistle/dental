import { Module } from '@nestjs/common';
import { OdontogramController } from './odontogram.controller';
import { OdontogramService } from './odontogram.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OdontogramController],
  providers: [OdontogramService],
  exports: [OdontogramService],
})
export class OdontogramModule {}

