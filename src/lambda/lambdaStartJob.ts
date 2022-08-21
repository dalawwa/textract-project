import {
	TextractClient,
	StartDocumentAnalysisCommand,
	FeatureType,
} from '@aws-sdk/client-textract';
import { SNSEvent } from 'aws-lambda';

const textractClient = new TextractClient({ apiVersion: 'latest' });

export const lambdaStartJob = async (event: SNSEvent) => {
	const message = event.Records[0].Sns.Message;
	console.log(message);
	const parsedMessage = JSON.parse(message).Records[0];
	console.log(parsedMessage);
	const s3Message = parsedMessage.s3;
	console.log(s3Message);

	const bucket = s3Message.bucket.name;
	const key = s3Message.object.key;

	const textTractResponse = await textractClient.send(
		new StartDocumentAnalysisCommand({
			FeatureTypes: [FeatureType.FORMS, FeatureType.TABLES],
			DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
			NotificationChannel: {
				RoleArn: process.env.NOTIFICATION_ROLE_ARN,
				SNSTopicArn: process.env.NOTIFICATION_TOPIC_ARN,
			},
		})
	);

	console.log({ textTractResponse });
	return textTractResponse.JobId;
};
