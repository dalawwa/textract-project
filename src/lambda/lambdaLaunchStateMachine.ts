import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { S3NotificationEvent } from 'aws-lambda';

const sfnClient = new SFNClient({ apiVersion: 'latest' });

export const lambdaLaunchStateMachine = async (event: S3NotificationEvent) => {
	console.log(JSON.stringify(event, null, 2));
	const response = await sfnClient.send(
		new StartExecutionCommand({
			stateMachineArn: process.env.STATEMACHINE_ARN,
			input: JSON.stringify(event, null, 2),
		})
	);

	console.log(response);
};
