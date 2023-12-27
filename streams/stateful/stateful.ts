import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

import { Construct } from 'constructs';

export class StreamsStatefulStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create the table which will store our films
    this.table = new dynamodb.Table(this, 'FilmTable', {
      tableName: 'films',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
    });
    this.table.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
  }
}
