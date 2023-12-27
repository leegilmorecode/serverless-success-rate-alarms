import {
  MetricUnits,
  Metrics,
  logMetrics,
} from '@aws-lambda-powertools/metrics';
import { Tracer, captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { errorHandler, logger, schemaValidator } from '@shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { injectLambdaContext } from '@aws-lambda-powertools/logger';
import { Film } from '@dto/play-film';
import { ValidationError } from '@errors';
import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import { schema } from '@schemas/film';
import { createFilmUseCase } from '@use-cases/create-film';

const tracer = new Tracer({});
const metrics = new Metrics({});

export const createFilmAdapter = async ({
  body,
}: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!body) throw new ValidationError('no payload body');

    const appointment = JSON.parse(body) as Film;

    schemaValidator(schema, appointment);

    const created: Film = await createFilmUseCase(appointment);

    metrics.addMetric('SuccessfulCreateFilm', MetricUnits.Count, 1);

    return {
      statusCode: 201,
      body: JSON.stringify(created),
    };
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) errorMessage = error.message;

    metrics.addMetric('CreateFilmError', MetricUnits.Count, 1);

    return errorHandler(error);
  }
};

export const handler = middy()
  .handler(createFilmAdapter)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics))
  .use(httpErrorHandler());
