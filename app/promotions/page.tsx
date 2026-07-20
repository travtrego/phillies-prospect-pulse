import promotionFeed from "../../data/promotions.json";
import "./promotions.css";

type PromotionRecord={playerId:number|null;player:string;date:string|null;fromAffiliate:string;fromLevel:string;toAffiliate:string;toLevel:string;description:string;source:string;};
function formatDate(value:string|null){if(!value)return"Date unavailable";return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(`${value}T12:00:00Z`));}
function formatUpdatedAt(value:string|null){if(!value)return"Waiting for first automated refresh";return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(value));}
export default function PromotionsPage(){
 const records=promotionFeed.records as PromotionRecord[];
 return <main>
  <header className="pageHeader"><span className="eyebrow">Organizational movement</span><h1>Promotions</h1><p>Confirmed upward assignments across the Phillies farm system, pulled from official MLB and MiLB transaction records.</p></header>
  <section className="movementPagePanel">
   <div className="panelHeading"><div><span className="eyebrow">Latest moves</span><h2>Player promotions</h2></div><span className="dataStatusPill">Every 6 hours</span></div>
   <p className="muted">Last refreshed: {formatUpdatedAt(promotionFeed.updatedAt)}</p>
   {records.length===0?<div className="emptyStateCompact"><strong>No promotion records loaded yet</strong><p>The next automated refresh will scan official affiliate transactions and populate this page.</p></div>:<div className="promotionList">{records.map(record=><article className="promotionCard" key={`${record.playerId??record.player}-${record.date}-${record.toLevel}`}><div className="promotionHeader"><div><span className="eyebrow">{formatDate(record.date)}</span><h3>{record.player}</h3></div><span className="promotionBadge">Promoted</span></div><div className="promotionRoute"><div><span>From</span><strong>{record.fromLevel}</strong><small>{record.fromAffiliate}</small></div><b aria-hidden="true">→</b><div><span>To</span><strong>{record.toLevel}</strong><small>{record.toAffiliate}</small></div></div><p>{record.description}</p><a href={record.source} target="_blank" rel="noreferrer">Official transaction source →</a></article>)}</div>}
  </section>
 </main>;
}
