import { z } from "zod";

/** Fecha en formato ISO `YYYY-MM-DD`, tal como la entrega un <input type="date">. */
export const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (formato esperado AAAA-MM-DD)");

export const uuid = z.uuid("Identificador inválido");
