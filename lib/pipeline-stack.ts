import { App, Stack, StackProps, SecretValue } from '@aws-cdk/core';
import { PipelineProject, BuildSpec, LinuxBuildImage } from '@aws-cdk/aws-codebuild';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction, CodeBuildAction, CloudFormationCreateUpdateStackAction } from '@aws-cdk/aws-codepipeline-actions';
import { CfnParametersCode } from '@aws-cdk/aws-lambda';

export interface PipelineStackProps extends StackProps {
  readonly lambdaCode: CfnParametersCode;
}

export class PipelineStack extends Stack {
  constructor(app: App, id: string, props: PipelineStackProps) {
    super(app, id, props);

    const cdkBuild = new PipelineProject(this, 'CdkBuild', {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: 'npm install',
          },
          build: {
            commands: [
              'npm run build',
              'npm run cdk synth -- -o dist'
            ],
          },
        },
        artifacts: {
          'base-directory': 'dist',
          files: [
            'dev-techtalk-LambdaStack.template.json',
          ],
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.UBUNTU_14_04_NODEJS_8_11_0,
      },
    });
    const lambdaBuild = new PipelineProject(this, 'LambdaBuild', {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          // install: {
          //   commands: [
          //     'cd lambda',
          //     'npm install',
          //   ],
          // },
          // build: {
          //   commands: [
          //     // 'npm run build',
          //   ]
          // },
        },
        artifacts: {
          'base-directory': 'lambda',
          files: [
            'index.js',
          ],
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.UBUNTU_14_04_NODEJS_8_11_0,
      },
    });

    const sourceOutput = new Artifact();
    const cdkBuildOutput = new Artifact('CdkBuildOutput');
    const lambdaBuildOutput = new Artifact('LambdaBuildOutput');
    const pat = process.env.PAT || 'nope'

    new Pipeline(this, 'Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new GitHubSourceAction({
              actionName: 'GitHub_Source',
              output: sourceOutput,
              branch: 'master',
              owner: 'stephen-cloud',
              repo: 'cdk-tech-talk',
              oauthToken: SecretValue.plainText(pat)
            }),
          ],
        }, {
          stageName: 'Build',
          actions: [
            new CodeBuildAction({
              actionName: 'Lambda_Build',
              project: lambdaBuild,
              input: sourceOutput,
              outputs: [lambdaBuildOutput],
            }),
            new CodeBuildAction({
              actionName: 'CDK_Build',
              project: cdkBuild,
              input: sourceOutput,
              outputs: [cdkBuildOutput],
            }),
          ],
        }, {
          stageName: 'Deploy',
          actions: [
            new CloudFormationCreateUpdateStackAction({
              actionName: 'Lambda_CFN_Deploy',
              templatePath: cdkBuildOutput.atPath('dev-techtalk-LambdaStack.template.json'),
              stackName: 'LambdaDeploymentStack',
              adminPermissions: true,
              parameterOverrides: {
                ...props.lambdaCode.assign(lambdaBuildOutput.s3Location),
              },
              extraInputs: [lambdaBuildOutput],
            }),
          ],
        },
      ],
    });
  }
}