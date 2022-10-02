import fetch from 'node-fetch'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

var AWS = require("aws-sdk");
AWS.config.update({region: 'us-west-2'});
var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});


function seconds_since_epoch(){ return Math.floor( Date.now() / 1000 ) }

async function updateItem(walletAddress, balanceJson) {
    var params = {
        TableName: "WalletMasterRecords",
        Key: {
            walletAddress: {
                S: walletAddress
            } 
        },

        UpdateExpression: 'set lastUpdate = :r',
        ExpressionAttributeValues: {
            ':r': String(seconds_since_epoch()),
        }
    };
    dynamodb.updateItem(params, function(err, data) {
       if(err) {
           console.log(err, err.stack);
       } else {
           console.log("db updated", data);
       }
    });
    return params;
}

export const handler = async (event) => {
    
    
    //TODO: this has to come from db itself
    const chain_id = ['43114', '56', '250'];
    const address = '0x6AE65a7033a84bb36778fEA6607A25a0d6c8EE50';
    
    let balanceJson = [];
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
        const params  = await updateItem(address, balanceJson);
        
    return balanceJson;
};
