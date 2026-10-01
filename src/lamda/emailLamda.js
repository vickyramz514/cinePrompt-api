import  {
  LambdaClient,
  InvokeCommand
} from '@aws-sdk/client-lambda';

export const sendMail = async (payload) => {
  const client = new LambdaClient({ region: 'ap-southeast-1' });
  const command = new InvokeCommand({
    FunctionName: 'datacaptain-send-email',
    Payload: Buffer.from(JSON.stringify(payload))
  });
  const response = await client.send(command);
  return JSON.parse(Buffer.from(response.Payload).toString());
};       