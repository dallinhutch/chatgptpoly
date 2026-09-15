import Decimal from 'decimal.js';
import type {Strategy} from './config';
const D=Decimal.clone({precision:32,rounding:Decimal.ROUND_DOWN});
export type Level={price:string;quantity:string};
export type Fill={price:string;quantity:string;notional:string;fee:string};
function valid(x:Decimal.Value, min=0,max=Infinity){const d=new D(x);if(!d.isFinite()||d.lt(min)||d.gt(max))throw Error('Invalid financial input');return d;}
export function aggregate(analysts:{probability:number;confidence:number;quality:number}[]){
 if(analysts.length<3)throw Error('At least three analyses required');
 for(const a of analysts)for(const x of [a.probability,a.confidence,a.quality])valid(x,0,1);
 const weights=analysts.map(a=>a.quality*a.quality),total=weights.reduce((a,b)=>a+b,0);if(!total)throw Error('No evidence quality');
 const mean=analysts.reduce((sum,a)=>sum+a.probability,0)/analysts.length;
 const probability=analysts.reduce((sum,a,i)=>sum+a.probability*weights[i],0)/total;
 const sorted=analysts.map(a=>a.probability).sort((a,b)=>a-b),n=sorted.length;
 const disagreement=Math.sqrt(analysts.reduce((s,a)=>s+(a.probability-mean)**2,0)/n);
 return {probability,mean,median:n%2?sorted[Math.floor(n/2)]:(sorted[n/2-1]+sorted[n/2])/2,disagreement,confidence:Math.min(...analysts.map(a=>a.confidence))*(1-disagreement),quality:Math.min(...analysts.map(a=>a.quality))};
}
export function sizePosition(input:{probability:number;price:string;confidence:number;equity:string;cash:string;exposure:string;categoryExposure:string;correlatedExposure:string;drawdown:number},s:Strategy){
 const p=valid(input.probability,0,1),price=valid(input.price,0,1),equity=valid(input.equity),cash=valid(input.cash);valid(input.confidence,0,1);valid(input.drawdown,0,1);
 if(price.lte(0)||price.gte(1)||input.drawdown>=s.maxDrawdown)return '0.000000';
 const effective=price.plus(s.feeBuffer);if(effective.gte(1))return '0.000000';
 const kelly=D.max(0,p.minus(effective).div(new D(1).minus(effective))).mul(s.kellyFraction).mul(input.confidence);
 const limits=[equity.mul(kelly),equity.mul(s.maxPosition),equity.mul(s.maxExposure).minus(valid(input.exposure)),equity.mul(s.maxCategory).minus(valid(input.categoryExposure)),equity.mul(s.maxCorrelated).minus(valid(input.correlatedExposure)),cash.minus(equity.mul(s.cashReserve))];
 return D.max(0,D.min(...limits)).toFixed(6);
}
/** Consume observed depth only. Whole shares, conservative per-fill fee rounding, no future or stale books. */
export function simulateBuy(levels:Level[],budget:string,limit:string,feeRate:number,observedAt:Date,now:Date,maxAgeSeconds:number){
 if(observedAt>now||now.getTime()-observedAt.getTime()>maxAgeSeconds*1000)throw Error('Stale or future order book');
 let remaining=valid(budget);const cap=valid(limit,0,1),rate=valid(feeRate,0,1),fills:Fill[]=[];
 for(const l of [...levels].sort((a,b)=>new D(a.price).cmp(b.price))){const px=valid(l.price,0,1),qty=valid(l.quantity).floor();if(px.lte(0)||px.gte(1)||px.gt(cap)||qty.isZero())continue;
 let quantity=D.min(qty,remaining.div(px.plus(rate))).floor();if(quantity.lte(0))continue;
 let notional=quantity.mul(px),fee=quantity.mul(rate).toDecimalPlaces(2,Decimal.ROUND_UP);
 while(quantity.gt(0)&&notional.plus(fee).gt(remaining)){quantity=quantity.minus(1);notional=quantity.mul(px);fee=quantity.mul(rate).toDecimalPlaces(2,Decimal.ROUND_UP);}
 if(quantity.lte(0))continue;remaining=remaining.minus(notional).minus(fee);fills.push({price:px.toFixed(6),quantity:quantity.toFixed(0),notional:notional.toFixed(6),fee:fee.toFixed(6)});
 }
 return {fills,spent:new D(budget).minus(remaining).toFixed(6),quantity:fills.reduce((s,f)=>s.plus(f.quantity),new D(0)).toFixed(0)};
}
export function settle(quantity:string,entryCost:string,payout:string){const proceeds=valid(quantity).mul(valid(payout,0,1));return {proceeds:proceeds.toFixed(6),pnl:proceeds.minus(valid(entryCost)).toFixed(6)};}
export function total(values:string[]){return values.reduce((a,v)=>a.plus(v),new D(0)).toFixed(6);}
export function markValue(quantity:string,price:string){return valid(quantity).mul(valid(price,0,1)).toFixed(6);}
