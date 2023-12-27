import { getISOString, logger, schemaValidator } from '@shared';

import { saveFilm } from '@adapters/secondary/database-adapter';
import { Film } from '@dto/play-film';
import { schema } from '@schemas/film';
import { v4 as uuid } from 'uuid';

export async function createFilmUseCase(film: Film): Promise<Film> {
  const created = getISOString();

  // create the new film object
  const newFilm = {
    id: uuid(),
    created: created,
    ...film,
  };

  // validate the film is in the correct shape
  schemaValidator(schema, newFilm);

  // save the film
  await saveFilm(newFilm);

  logger.info(`film successfully created with id ${newFilm.id}`);
  return newFilm;
}
