import { logger, schemaValidator } from '@shared';

import { getFilmById } from '@adapters/secondary/database-adapter';
import { Film } from '@dto/play-film';
import { ResourceNotFoundError } from '@errors';
import { schema } from '@schemas/film';

export async function playFilmUseCase(id: string): Promise<Film> {
  // get the film from the datastore
  const film = await getFilmById(id);

  if (!film) throw new ResourceNotFoundError(`film with ${id} not found`);

  // validate the film is in the correct shape
  schemaValidator(schema, film);

  logger.info(`film successfully retrieved for id ${id}`);
  return film;
}
