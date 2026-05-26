import { Module } from '@nestjs/common';
import { ProsthesisTypesService } from './prosthesis-types.service';
import { ProsthesisTypesController } from './prosthesis-types.controller';

@Module({
  controllers: [ProsthesisTypesController],
  providers: [ProsthesisTypesService],
  exports: [ProsthesisTypesService],
})
export class ProsthesisTypesModule {}
