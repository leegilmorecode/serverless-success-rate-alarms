#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { StreamsStatefulStack } from '../stateful/stateful';
import { StreamsStatelessStack } from '../stateless/stateless';

const app = new cdk.App();
const streamsStatefulStack = new StreamsStatefulStack(
  app,
  'StreamsStatefulStack',
  {}
);
new StreamsStatelessStack(app, 'StreamsStatelessStack', {
  table: streamsStatefulStack.table,
});
