import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as path from 'path';

import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Tracing } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface StreamsStatelessStackProps extends cdk.StackProps {
  table: dynamodb.Table;
}

export class StreamsStatelessStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: StreamsStatelessStackProps) {
    super(scope, id, props);

    this.table = props.table;

    // constants
    const serviceName = 'FilmStreamService';
    const metricNamespace = 'FilmStreamNamespace';
    const emailAddress = 'your.name@email.com';

    // add our lambda config
    const lambdaConfig = {
      LOG_LEVEL: 'DEBUG',
      POWERTOOLS_LOGGER_LOG_EVENT: 'true',
      POWERTOOLS_LOGGER_SAMPLE_RATE: '1',
      POWERTOOLS_TRACE_ENABLED: 'enabled',
      POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: 'captureHTTPsRequests',
      POWERTOOLS_SERVICE_NAME: serviceName,
      POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'captureResult',
      POWERTOOLS_METRICS_NAMESPACE: metricNamespace,
      TABLE_NAME: this.table.tableName,
    };

    // create the lambda for starting a film stream
    const playFilmLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'PlayFilmLambda', {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/play-film/play-film.adapter.ts'
        ),
        memorySize: 1024,
        timeout: cdk.Duration.seconds(5),
        tracing: Tracing.ACTIVE,
        handler: 'handler',
        bundling: {
          minify: true,
          externalModules: [],
        },
        environment: {
          ...lambdaConfig,
        },
      });

    // create the lambda for adding a new film
    const createFilmLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'CreateFilmLambda', {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/create-film/create-film.adapter.ts'
        ),
        memorySize: 1024,
        timeout: cdk.Duration.seconds(5),
        tracing: Tracing.ACTIVE,
        handler: 'handler',
        bundling: {
          minify: true,
          externalModules: [],
        },
        environment: {
          ...lambdaConfig,
        },
      });

    // give the lambdas access to the dynamodb table
    this.table.grantReadData(playFilmLambda);
    this.table.grantWriteData(createFilmLambda);

    // create the api gateway for film streaming
    const api: apigw.RestApi = new apigw.RestApi(this, 'FilmStreamApi', {
      description: 'Film Stream API',
      endpointTypes: [apigw.EndpointType.REGIONAL],
      deploy: true,
      deployOptions: {
        stageName: 'prod',
        dataTraceEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        tracingEnabled: true,
        metricsEnabled: true,
      },
    });
    api.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // create the films resource and methods
    const films: apigw.Resource = api.root.addResource('films');
    const film: apigw.Resource = films.addResource('{id}');

    films.addMethod(
      'POST',
      new apigw.LambdaIntegration(createFilmLambda, {
        proxy: true,
      })
    );

    film.addMethod(
      'GET',
      new apigw.LambdaIntegration(playFilmLambda, {
        proxy: true,
      })
    );

    // Create the Metric Filter for the lambda function logs specifically
    const metricFilter = playFilmLambda.logGroup.addMetricFilter(
      'SuccessfulFilmPlaysFilter',
      {
        filterName: 'SuccessfulFilmPlaysFilter',
        filterPattern: logs.FilterPattern.literal(
          `{ $.SuccessfulFilmPlay = 1 && $.service = "${serviceName}" }`
        ),
        metricName: 'SuccessfulFilmPlaysFilter',
        metricNamespace: metricNamespace,
        metricValue: '1',
        defaultValue: 0,
      }
    );
    metricFilter.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // ensure that we fill missing periods with a 0 otherwise the alarm
    // will not trigger for > 5 mins as discussed here:
    // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html
    const metricsMathExpression = new cloudwatch.MathExpression({
      expression: 'FILL(m1, 0)',
      label: 'SuccessfulFilmPlaysAlarmExpression',
      period: cdk.Duration.minutes(1),
      usingMetrics: {
        ['m1']: metricFilter.metric({
          period: cdk.Duration.minutes(1),
          statistic: cloudwatch.Stats.SUM,
        }),
      },
    });

    // we create the alarm based on the math expression, as we need to ensure that
    // missing metrics are filled with 0, to ensure that our alarm triggers quickly
    const alarm = metricsMathExpression.createAlarm(this, 'CloudWatchAlarm', {
      alarmName: 'SuccessfulFilmPlaysAlarm',
      alarmDescription: 'Error When Successful Plays Drops Below Threshold',
      threshold: 1, // we want to ensure that we get at least 1 video play per minute
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      actionsEnabled: true,
      // we want to know when we have no metrics
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    alarm.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // create our sns topic for our alarm
    const topic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'FilmPlayAlarmTopic',
      topicName: 'FilmPlayAlarmTopic',
    });
    topic.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Add an action for the alarm which sends to our sns topic
    alarm.addAlarmAction(new SnsAction(topic));

    // send an email when a message drops into the topic
    topic.addSubscription(new snsSubs.EmailSubscription(emailAddress));
  }
}
