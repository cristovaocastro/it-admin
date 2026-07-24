import "server-only";
import {
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  RebootInstancesCommand,
} from "@aws-sdk/client-ec2";
import { getEc2Client } from "@/lib/aws/client";
import type { AwsConnectionConfig } from "@/lib/aws/types";

export type AwsEc2Instance = {
  instanceId: string;
  name?: string;
  instanceType: string;
  state: string; // pending | running | shutting-down | terminated | stopping | stopped
  publicIp?: string;
  privateIp?: string;
  availabilityZone?: string;
  region: string;
};

/** Lista instâncias EC2 em todas as regiões monitoradas pela conexão. */
export async function listEc2Instances(config: AwsConnectionConfig): Promise<AwsEc2Instance[]> {
  const perRegion = await Promise.all(
    config.regions.map(async (region) => {
      const client = getEc2Client(config, region);
      const instances: AwsEc2Instance[] = [];
      let nextToken: string | undefined;
      do {
        const result = await client.send(new DescribeInstancesCommand({ NextToken: nextToken }));
        for (const reservation of result.Reservations ?? []) {
          for (const instance of reservation.Instances ?? []) {
            if (!instance.InstanceId) continue;
            instances.push({
              instanceId: instance.InstanceId,
              name: instance.Tags?.find((t) => t.Key === "Name")?.Value,
              instanceType: instance.InstanceType ?? "—",
              state: instance.State?.Name ?? "unknown",
              publicIp: instance.PublicIpAddress,
              privateIp: instance.PrivateIpAddress,
              availabilityZone: instance.Placement?.AvailabilityZone,
              region,
            });
          }
        }
        nextToken = result.NextToken;
      } while (nextToken);
      return instances;
    })
  );
  return perRegion.flat();
}

export type Ec2InstanceAction = "start" | "stop" | "reboot";

export async function setEc2InstanceState(
  config: AwsConnectionConfig,
  region: string,
  instanceId: string,
  action: Ec2InstanceAction
): Promise<void> {
  const client = getEc2Client(config, region);
  const InstanceIds = [instanceId];
  if (action === "start") await client.send(new StartInstancesCommand({ InstanceIds }));
  else if (action === "stop") await client.send(new StopInstancesCommand({ InstanceIds }));
  else await client.send(new RebootInstancesCommand({ InstanceIds }));
}
