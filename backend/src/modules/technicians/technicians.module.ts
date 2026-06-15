import { Module } from '@nestjs/common';
import { TechniciansService } from './technicians.service';
import { TechniciansController } from './technicians.controller';

@Module({
  imports: [],
  controllers: [TechniciansController],
  providers: [TechniciansService],
})
export class TechniciansModule {}
