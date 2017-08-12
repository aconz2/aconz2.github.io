---
layout: post
title:  "AWS Cloudformation Lambda Example"
date:   2017-08-12
categories:
---

This is just some mental notes from getting a Cloudformation template setup

## References

  - [Resource Types](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-template-resource-type-ref.html)
  - [Parameters](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html)

## Example

This example (at the bottom) shows (almost) everything needed to deploy a Lambda function which can:

  - Write to CloudWatch logs
  - Access an s3 bucket
  - Read some configuration variables
  - Get secret configuration variables from the command line (so you don't commit secrets)
  - Get triggered on a schedule

Note that for bonus points you could put in more rules to, for example ensure the `lambda-code-deploy` bucket exists. But I already had that created. Maybe next time.

### Usage

```
# You'll need to first bundle your deployment artificat (I haven't found a great way of doing this yet besides a one-off script)
aws s3 cp my-code-bundle.zip s3://lambda-code-deploy/

aws cloudformation deploy --template-file cloudformation.json --stack-name my-example-stack --capabilities CAPABILITY_IAM --parameter-overrides SuperSecretPassword=foobar
```

### Notes

  - There are almost no names on any of these resources; they get created as part of a stack and get attached under the `--stack-name`
  - The `CAPABILITY_IAM` bit is because this creates a role and attaches policies to it
  - The `LambdaRole` contains inline policies but these can also be attached by reference
  - The gigantic blob of JSON was really intimidating at first, but gets slightly better once you see how much time this can save you

### Future Work

  - I'd like to find a tool dedicated to building the deployment artifact. I don't want any extra features or part of a larger framework.
  - I should add the versioning to this
  - Think about the right place to add dev/staging/prod config/setup
  - Look into (troposhere)[https://github.com/cloudtools/troposphere]
    - This is appealing because doing things like `Fn::Join` crap feels all wrong. The idea would be to have python replace most of those facilities for stamping out new versions etc

I'd like to get to a point where I can just say (in a python file)

```python
cloudformation(
  schedule('module1.func', rate='1 hour', env={'foo': 'bar'}),
  schedule('module2.func', rate='5 minutes'),
  schedule('module3.func', rate='1 week')
)
```

And `schedule` would be defined as a function returning a stack. `cloudformation` would take a list of stacks. That python function can then be run to provide some niceties that `aws cloudformation` currently lacks like viewing traces if something fails etc.

### The JSON

```json
{
  "Parameters": {
    "SuperSecretPassowrd": {
      "Type": "String",
      "Description": "Your super secret password",
      "NoEcho": true
    }
  },
  "Description": "An example Cloudformation",
  "Resources": {
    "LambdaFunction": {
      "Type": "AWS::Lambda::Function",
      "DependsOn": [
        "LambdaRole"
      ],
      "Properties": {
        "Handler": "lam.handler",
        "Timeout": 180,
        "Environment": {
          "Variables": {
            "this_is_a_configuration": "beep boop",
            "super_secret_password": {
              "Ref": "SuperSecretPassowrd"
            },
          }
        },
        "Role": {
          "Fn::GetAtt": [
            "LambdaRole",
            "Arn"
          ]
        },
        "Code": {
          "S3Bucket": "lambda-code-deploy",
          "S3Key": "my-code-bundle.zip"
        },
        "Runtime": "python3.6"
      }
    },
    "LambdaRole": {
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Principal": {
                "Service": "lambda.amazonaws.com"
              },
              "Action": "sts:AssumeRole"
            }
          ]
        },
        "Policies": [
          {
            "PolicyName": "LambdaPolicy",
            "PolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Action": [
                    "s3:*"
                  ],
                  "Resource": [
                    "arn:aws:s3:::some-bucket-you-want-to-access/*"
                  ]
                },
                {
                  "Effect": "Allow",
                  "Action": [
                    "logs:*"
                  ],
                  "Resource": [
                    "*"
                  ]
                }
              ]
            }
          }
        ]
      }
    },
    "ScheduledRule": {
      "Type": "AWS::Events::Rule",
      "Properties": {
        "Description": "ScheduledRule",
        "ScheduleExpression": "rate(1 hour)",
        "State": "ENABLED",
        "Targets": [
          {
            "Arn": {
              "Fn::GetAtt": [
                "LambdaFunction",
                "Arn"
              ]
            },
            "Id": "TargetFunctionV1"
          }
        ]
      }
    },
    "PermissionForEventsToInvokeLambda": {
      "Type": "AWS::Lambda::Permission",
      "Properties": {
        "FunctionName": {
          "Ref": "LambdaFunction"
        },
        "Action": "lambda:InvokeFunction",
        "Principal": "events.amazonaws.com",
        "SourceArn": {
          "Fn::GetAtt": [
            "ScheduledRule",
            "Arn"
          ]
        }
      }
    }
  }
}
```
