import "server-only";
import { DescribeVpcsCommand, DescribeVpnConnectionsCommand, DescribeVpcEndpointsCommand } from "@aws-sdk/client-ec2";
import { getEc2Client } from "@/lib/aws/client";
import type { AwsConnectionConfig } from "@/lib/aws/types";

function nameTag(tags?: { Key?: string; Value?: string }[]): string | undefined {
  return tags?.find((t) => t.Key === "Name")?.Value;
}

export type AwsVpc = {
  vpcId: string;
  name?: string;
  cidrBlock?: string;
  isDefault: boolean;
  state: string;
  region: string;
};

export async function listVpcs(config: AwsConnectionConfig): Promise<AwsVpc[]> {
  const perRegion = await Promise.all(
    config.regions.map(async (region) => {
      const client = getEc2Client(config, region);
      const result = await client.send(new DescribeVpcsCommand({}));
      return (result.Vpcs ?? []).map((v) => ({
        vpcId: v.VpcId ?? "—",
        name: nameTag(v.Tags),
        cidrBlock: v.CidrBlock,
        isDefault: v.IsDefault ?? false,
        state: v.State ?? "unknown",
        region,
      }));
    })
  );
  return perRegion.flat();
}

export type AwsVpnTunnel = { outsideIp?: string; status: string; statusMessage?: string };

export type AwsVpnConnection = {
  vpnConnectionId: string;
  name?: string;
  state: string;
  customerGatewayId?: string;
  tunnels: AwsVpnTunnel[];
  region: string;
};

export async function listVpnConnections(config: AwsConnectionConfig): Promise<AwsVpnConnection[]> {
  const perRegion = await Promise.all(
    config.regions.map(async (region) => {
      const client = getEc2Client(config, region);
      const result = await client.send(new DescribeVpnConnectionsCommand({}));
      return (result.VpnConnections ?? []).map((c) => ({
        vpnConnectionId: c.VpnConnectionId ?? "—",
        name: nameTag(c.Tags),
        state: c.State ?? "unknown",
        customerGatewayId: c.CustomerGatewayId,
        tunnels: (c.VgwTelemetry ?? []).map((t) => ({
          outsideIp: t.OutsideIpAddress,
          status: t.Status ?? "unknown",
          statusMessage: t.StatusMessage,
        })),
        region,
      }));
    })
  );
  return perRegion.flat();
}

export type AwsVpcEndpoint = {
  vpcEndpointId: string;
  name?: string;
  serviceName?: string;
  type: string;
  state: string;
  vpcId?: string;
  region: string;
};

export async function listVpcEndpoints(config: AwsConnectionConfig): Promise<AwsVpcEndpoint[]> {
  const perRegion = await Promise.all(
    config.regions.map(async (region) => {
      const client = getEc2Client(config, region);
      const result = await client.send(new DescribeVpcEndpointsCommand({}));
      return (result.VpcEndpoints ?? []).map((e) => ({
        vpcEndpointId: e.VpcEndpointId ?? "—",
        name: nameTag(e.Tags),
        serviceName: e.ServiceName,
        type: e.VpcEndpointType ?? "unknown",
        state: e.State ?? "unknown",
        vpcId: e.VpcId,
        region,
      }));
    })
  );
  return perRegion.flat();
}
