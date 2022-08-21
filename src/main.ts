import { join } from 'path';
import { App, Stack, StackProps } from 'aws-cdk-lib';
import {
	Effect,
	ManagedPolicy,
	PolicyStatement,
	Role,
	ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { SnsDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import {
	StateMachine,
	Succeed,
	TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';

import { Construct } from 'constructs';

export class MyStack extends Stack {
	constructor(scope: Construct, id: string, props: StackProps = {}) {
		super(scope, id, props);

		const sourceBucket = new Bucket(this, 'textract-source-bucket');
		const outputBucket = new Bucket(this, 'textract-output-bucket');
		const sourceTopic = new Topic(this, 'textract-sns-source-topic');
		const textractAsyncTopic = new Topic(this, 'textract-async-topic');

		const notificationRole = new Role(this, 'TextractAsyncSNSRole', {
			assumedBy: new ServicePrincipal('textract.amazonaws.com'),
			managedPolicies: [
				ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess'),
				ManagedPolicy.fromAwsManagedPolicyName('AmazonSNSFullAccess'),
				ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
				ManagedPolicy.fromAwsManagedPolicyName('AmazonTextractFullAccess'),
			],
		});

		const lambdaStartJob = new NodejsFunction(
			this,
			'textract-lambda-start-job',
			{
				runtime: Runtime.NODEJS_16_X,
				deadLetterQueueEnabled: true,
				bundling: {
					nodeModules: ['@aws-sdk/client-s3', '@aws-sdk/client-textract'],
				},
				description:
					'lambda calling textract when new object arrives in bucket',
				entry: join(__dirname, './lambda/lambdaStartJob.ts'),
				handler: 'lambdaStartJob',
				environment: {
					NOTIFICATION_ROLE_ARN: notificationRole.roleArn,
					NOTIFICATION_TOPIC_ARN: textractAsyncTopic.topicArn,
				},
			}
		);

		lambdaStartJob.addToRolePolicy(
			new PolicyStatement({
				actions: ['textract:Start*', 'textract:Get*'],
				resources: ['*'],
			})
		);

		sourceBucket.grantReadWrite(lambdaStartJob);

		const getJobResponse = new NodejsFunction(this, 'textract-lambda-get-job', {
			runtime: Runtime.NODEJS_16_X,
			deadLetterQueueEnabled: true,
			bundling: {
				nodeModules: ['@aws-sdk/client-s3', '@aws-sdk/client-textract'],
			},
			description: 'lambda calling textract when new textract response arrives',
			entry: join(__dirname, './lambda/lambdaGetJob.ts'),
			handler: 'lambdaGetJob',
			environment: {
				NOTIFICATION_ROLE_ARN: notificationRole.roleArn,
				NOTIFICATION_TOPIC_ARN: textractAsyncTopic.topicArn,
			},
		});

		getJobResponse.addToRolePolicy(
			new PolicyStatement({
				actions: ['textract:Get*'],
				effect: Effect.ALLOW,
				resources: ['*'],
			})
		);

		// STATE MACHINE
		const startJob = new LambdaInvoke(this, 'start textract job', {
			lambdaFunction: lambdaStartJob,
			payload: TaskInput.fromJsonPathAt('$'),
			resultPath: '$.guid',
		});

		const getJobResponseTask = new LambdaInvoke(
			this,
			'get textract job response',
			{
				lambdaFunction: getJobResponse,
				payload: TaskInput.fromJsonPathAt('$'),
			}
		);

		const sm = new StateMachine(this, 'textract-state-machine', {
			definition: startJob
				.next(getJobResponseTask)
				.next(new Succeed(this, 'textract-success-response-state')),
		});

		sourceBucket.grantReadWrite(sm);
		outputBucket.grantReadWrite(sm);
		sourceBucket.addObjectCreatedNotification(new SnsDestination(sourceTopic));
		textractAsyncTopic.addSubscription(new LambdaSubscription(getJobResponse));

		const laucherFn = new NodejsFunction(
			this,
			'textract-lambda-statemachine-launcher',
			{
				runtime: Runtime.NODEJS_16_X,
				deadLetterQueueEnabled: true,
				bundling: {
					nodeModules: [
						'@aws-sdk/client-s3',
						'@aws-sdk/client-textract',
						'@aws-sdk/client-sfn',
					],
				},
				description:
					'lambda calling the statemachine to textract when new object arrives in bucket',
				entry: join(__dirname, './lambda/lambdaLaunchStateMachine.ts'),
				handler: 'lambdaLaunchStateMachine',
				environment: {
					NOTIFICATION_ROLE_ARN: notificationRole.roleArn,
					NOTIFICATION_TOPIC_ARN: textractAsyncTopic.topicArn,
					STATEMACHINE_ARN: sm.stateMachineArn,
				},
			}
		);

		sourceTopic.addSubscription(new LambdaSubscription(laucherFn));
		laucherFn.addToRolePolicy(
			new PolicyStatement({
				actions: ['states:StartExecution'],
				effect: Effect.ALLOW,
				resources: [sm.stateMachineArn],
			})
		);

		console.log(sourceBucket, outputBucket, lambdaStartJob);

		console.log(sm);
	}
}

// for development, use account/region from cdk cli
const devEnv = {
	account: process.env.CDK_DEFAULT_ACCOUNT,
	region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'textractStack-dev', { env: devEnv });
// new MyStack(app, 'textractStack-prod', { env: prodEnv });

app.synth();
