import {
	GetDocumentAnalysisCommand,
	TextractClient,
} from '@aws-sdk/client-textract';

const textractClient = new TextractClient({ apiVersion: 'latest' });

export const lambdaGetJob = async (event: any) => {
	console.log(JSON.stringify(event));
	let result;
	try {
		const parsedMessage = JSON.parse(event.Records[0].Sns.Message);
		if (parsedMessage.Status === 'SUCCEEDED') {
			result = await textractClient.send(
				new GetDocumentAnalysisCommand({
					JobId: parsedMessage.JobId,
				})
			);
		}
	} catch (e) {
		console.log(e);
	}

	console.log(result);
	return result;
};
