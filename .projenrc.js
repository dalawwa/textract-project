const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
	cdkVersion: '2.1.0',
	defaultReleaseBranch: 'main',
	name: 'textractstack',

	deps: [
		'aws-cdk-lib',
		'constructs',
		'@types/aws-lambda',
		'@aws-sdk/client-s3',
		'@aws-sdk/client-textract',
		'@aws-sdk/client-sfn',
	],
	prettier: true,
	prettierOptions: {
		settings: {
			singleQuote: true,
			useTabs: true,
			plugins: ['prettier-standard'],
		},
	},
	eslintOptions: {
		prettier: true,
		prettierOptions: {
			settings: {
				singleQuote: true,
				useTabs: true,
				plugins: ['prettier-standard'],
			},
		},
	},
	// description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
	devDeps: ['prettier-standard'],
	// packageName: undefined,  /* The "name" in package.json. */
});
project.synth();
