#!/usr/bin/env node

// bin/pipeline.ts

import { App } from '@aws-cdk/core';
import { LambdaStack } from '../lib/lambda-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new App();

const lambdaStack = new LambdaStack(app, 'dev-techtalk-LambdaStack');
new PipelineStack(app, 'dev-techtalk-PipelineDeployingLambdaStack', {
  lambdaCode: lambdaStack.lambdaCode,
});

app.synth();