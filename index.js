import fetch from 'node-fetch'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

var AWS = require("aws-sdk");
AWS.config.update({region: 'us-west-2'});
var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

//hardcoding for now
const thresholdInsecs = 5000;

function seconds_since_epoch(){ return Math.floor( Date.now() / 1000 ) }

async function insertItem(walletAddress, balanceJson) {
    //hardcoing last key to 123 for now, 
    var params = {
        Item: {
            walletAddress: {
                S: walletAddress
            },
            AVAX: {
                SS: [String(balanceJson[0]), '123']
            },
            BNB: {
                SS: [String(balanceJson[1]), '123']
            },
            FTM: {
                SS: [String(balanceJson[2]), '123']
            },
            lastUpdate: {
                N: String(seconds_since_epoch())
            }
        },
        TableName: "WalletMasterRecords",
    };
    
    console.log("db put Item");
    
    dynamodb.putItem(params, function(err, data) {
       if(err) {
           console.log(err, err.stack);
       } else {
           console.log("db updated", data);
       }
    });
    return params;
}

async function getItem(walletAddress) {
    let flag = true;
    try {
        console.log("walletAddress: ", walletAddress);
        var params = {
            Key: {
                "walletAddress": {"S": walletAddress},
            },
            TableName: 'WalletMasterRecords'
        };
        var result = await dynamodb.getItem(params).promise();
        console.log("dynamodb result", JSON.stringify(result));
        const lastUpdate = result['Item']['lastUpdate']['N'];
        const diff = seconds_since_epoch() - lastUpdate;
        console.log("diff: ", diff);
        if(diff < thresholdInsecs) {
            flag = false;
        }
        
    } catch (error) {
        console.error(error);
    }
    return {flag, result};
}

export const handler = async (event) => {
  
    console.log("Incoming event:", event);
    //TODO: This eventually has to come has input
    const chain_id = ['43114', '56', '250'];
    //const chain_id = event['queryStringParameters']['coin'];
    const address = event['queryStringParameters']['wallet'];
    let balanceJson = [];
    let dbResponse = await getItem(address);
    console.log("dbResponse: ", dbResponse);
    console.log('Item:', dbResponse.result.Item);
    //set for true for now.
    dbResponse.flag = true;
    if(dbResponse.flag == false) {
        balanceJson.push(dbResponse.result.Item.AVAX.SS.balance);
        balanceJson.push(dbResponse.result.Item.BNB.SS.balance);
        balanceJson.push(dbResponse.result.Item.FTM.SS.balance);
    } else {
        //hardcoding for now.
        for(let i = 0; i < chain_id.length; i++) {
            const apiResponse = await fetch('https://api.covalenthq.com/v1/' + chain_id[i] + '/address/' + address + '/balances_v2/?quote-currency=USD&format=JSON&nft=false&no-nft-fetch=false&key=ckey_67a864f2a08941a9a5a88f32f1d');
            const responseJson = await apiResponse.json();
            console.log(responseJson);
            const allItems = responseJson['data']['items'];
            let balance = 0;
            for(let i = 0; i < 1; i++) {
                const coins = allItems[i]['balance'] / Math.pow(10, 18);
                balance += allItems[i]['quote']*coins;
            }
            balance = Math.round(balance*100)/100;
            balanceJson.push(balance);
        }
        const params  = await insertItem(address, balanceJson);
        console.log("db updated params", params);
    }
   
    const response = {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
      },
      body: JSON.stringify(balanceJson),
    };
    
    return response;
 
};
