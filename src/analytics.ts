export function performance(positions:any[],snapshots:any[],orders:any[]){
 const closed=positions.filter(p=>p.closed_at),wins=closed.filter(p=>Number(p.realized_pnl)>0),losses=closed.filter(p=>Number(p.realized_pnl)<0);
 const sum=(rows:any[])=>rows.reduce((a,p)=>a+Number(p.realized_pnl),0),gains=sum(wins),loss=-sum(losses);
 const valid=snapshots.filter(s=>!s.stale_marks),equity=Number(valid.at(-1)?.equity??1000),openValue=Number(valid.at(-1)?.open_value??0),openCost=positions.filter(p=>!p.closed_at).reduce((a,p)=>a+Number(p.cost),0);
 let peak=1000,drawdown=0;for(const s of valid){peak=Math.max(peak,Number(s.equity));drawdown=Math.max(drawdown,1-Number(s.equity)/peak);}
 const group=(key:(p:any)=>string)=>{const groups:Record<string,{count:number;pnl:number}>={};for(const p of closed){const k=key(p);groups[k]??={count:0,pnl:0};groups[k].count++;groups[k].pnl+=Number(p.realized_pnl);}return groups;};
 const lookup=(p:any)=>orders.find(o=>String(o.id)===String(p.order_id));
 return {realized:gains-loss,unrealized:openValue-openCost,totalReturn:equity/1000-1,maxDrawdown:drawdown,winRate:closed.length?wins.length/closed.length:null,lossRate:closed.length?losses.length/closed.length:null,averageWin:wins.length?gains/wins.length:null,averageLoss:losses.length?-loss/losses.length:null,profitFactor:loss?gains/loss:null,trades:orders.length,averageEdge:orders.length?orders.reduce((a,o)=>a+Number(o.decision.edge),0)/orders.length:null,averageConfidence:orders.length?orders.reduce((a,o)=>a+Number(o.confidence),0)/orders.length:null,byCategory:group(p=>p.category),byStrategy:group(p=>'v'+lookup(p)?.strategy_id),byConfidence:group(p=>`${Math.floor(Number(lookup(p)?.confidence??0)*10)*10}%`),byEdge:group(p=>`${Math.floor(Number(lookup(p)?.decision.edge??0)*20)*5}%`)};
}
