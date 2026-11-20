param([string]$Region = 'eu-north-1')
Write-Host "Read-only AWS resource inventory in $Region"
aws ec2 describe-instances --region $Region --query 'Reservations[].Instances[].[InstanceId,State.Name,InstanceType]' --output table
aws ec2 describe-volumes --region $Region --query 'Volumes[].[VolumeId,State,Size]' --output table
aws ec2 describe-addresses --region $Region --query 'Addresses[].[PublicIp,AllocationId]' --output table
aws elbv2 describe-load-balancers --region $Region --query 'LoadBalancers[].[LoadBalancerName,State.Code]' --output table
aws rds describe-db-instances --region $Region --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceStatus,AllocatedStorage]' --output table
aws autoscaling describe-auto-scaling-groups --region $Region --query 'AutoScalingGroups[].[AutoScalingGroupName,MinSize,MaxSize,DesiredCapacity]' --output table
