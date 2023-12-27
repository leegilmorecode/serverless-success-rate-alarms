import {
  MetricUnits,
  Metrics,
  logMetrics,
} from '@aws-lambda-powertools/metrics';
import { Tracer, captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { errorHandler, logger } from '@shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { injectLambdaContext } from '@aws-lambda-powertools/logger';
import { Film } from '@dto/play-film';
import { ValidationError } from '@errors';
import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import { playFilmUseCase } from '@use-cases/play-film';

const tracer = new Tracer();
const metrics = new Metrics();

export const playFilmAdapter = async ({
  pathParameters,
}: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = pathParameters?.id;

    if (!id) throw new ValidationError('id is not supplied');

    const film: Film = await playFilmUseCase(id);

    metrics.addMetric('SuccessfulFilmPlay', MetricUnits.Count, 1);

    return {
      statusCode: 200,
      body: JSON.stringify(film),
    };
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) errorMessage = error.message;
    logger.error(errorMessage);

    metrics.addMetric('PlayFilmError', MetricUnits.Count, 1);

    return errorHandler(error);
  }
};

export const handler = middy()
  .handler(playFilmAdapter)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics))
  .use(httpErrorHandler());
