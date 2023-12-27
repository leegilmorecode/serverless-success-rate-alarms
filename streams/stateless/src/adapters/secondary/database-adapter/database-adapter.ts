import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandInput,
  PutItemCommand,
  PutItemCommandInput,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { config } from '@config';
import { Film } from '@dto/play-film';
import { logger } from '@shared';

const dynamoDb = new DynamoDBClient({});

export async function saveFilm(newFilm: Film): Promise<Film> {
  const tableName = config.get('tableName');

  const params: PutItemCommandInput = {
    TableName: tableName,
    Item: marshall(newFilm),
  };

  try {
    await dynamoDb.send(new PutItemCommand(params));

    logger.info(`new film created with id ${newFilm.id} into ${tableName}`);

    return newFilm;
  } catch (error) {
    console.error('error creating film:', error);
    throw error;
  }
}

export async function getFilmById(filmId: string): Promise<Film | null> {
  const tableName = config.get('tableName');

  const params: GetItemCommandInput = {
    TableName: tableName,
    Key: {
      id: { S: filmId },
    },
  };

  try {
    const { Item } = await dynamoDb.send(new GetItemCommand(params));

    if (Item) {
      const film = unmarshall(Item) as Film;
      logger.info(`film with id ${filmId} retrieved from ${tableName}`);
      return film;
    } else {
      logger.warn(`film with id ${filmId} not found in ${tableName}`);
      return null;
    }
  } catch (error) {
    console.error(`error retrieving film with id ${filmId}:`, error);
    throw error;
  }
}
