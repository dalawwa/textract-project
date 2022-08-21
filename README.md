![infrastructure](https://user-images.githubusercontent.com/7680079/185813438-403b4a90-c442-49b7-ad57-73f7bdd980b0.svg)

# AWS Textract App

- object creation in source S3 Bucket pushes notification to source SNS Topic
- LambdaLaunchStateMachine subscribes to source SNS Topic and starts the
  Step Function Statemachine
- The Statemachine handles the async flow of document analysis up to getting the
  analysis result
- what to do with the result is left open for now (e.g. automatic classification based on content, indexation for searching, compliance...)
