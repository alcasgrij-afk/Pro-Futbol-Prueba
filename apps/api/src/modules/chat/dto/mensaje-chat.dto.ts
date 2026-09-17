import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Cuerpo del POST /chat/mensajes. `sessionId` es opcional: si el cliente
 * recien empieza (o perdio el id), el servidor genera uno nuevo y lo devuelve
 * en la respuesta para que el cliente lo persista.
 *
 * `fecha` es opcional: si el cliente eligio una fecha en el date picker del
 * chat, viaja en cada mensaje y se guarda en la sesion. Sin ella, el bot usa
 * la fecha que ya tenia la sesion o "hoy".
 */
export class MensajeChatDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sessionId?: string;

  @IsString()
  @IsNotEmpty()
  texto: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato YYYY-MM-DD.' })
  fecha?: string;
}