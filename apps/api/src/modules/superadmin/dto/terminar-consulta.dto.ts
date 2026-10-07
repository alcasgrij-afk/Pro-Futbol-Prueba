import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class TerminarConsultaDto {
  @ApiProperty({ example: 12345 })
  @IsInt()
  @Min(1)
  pid: number;
}
