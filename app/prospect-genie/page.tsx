import ProspectGenie from './ProspectGenie';
import rankingsData from '../../data/rankings.json';
import statsData from '../../data/stats.json';
import injuriesData from '../../data/injuries.json';
import promotionsData from '../../data/promotions.json';
import newsData from '../../data/news.json';
import './genie.css';

export default function ProspectGeniePage(){
  return <main>
    <header className="pageHeader genieHeader">
      <span className="eyebrow">Phillies farm-system intelligence</span>
      <h1>Prospect Genie</h1>
      <p>Ask plain-English questions about rankings, performance, promotions, injuries, development trends and future outcomes. Every answer is grounded in the site's automated data feeds.</p>
    </header>
    <ProspectGenie
      rankings={rankingsData.records}
      stats={statsData.records}
      injuries={injuriesData.records}
      promotions={promotionsData.records}
      news={newsData.articles}
      updatedAt={rankingsData.updatedAt}
    />
  </main>;
}
