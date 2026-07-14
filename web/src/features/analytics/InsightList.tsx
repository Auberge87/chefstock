import { Link } from 'react-router-dom'
import type { Insight } from './useInsights'

export function InsightList({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null
  return (
    <>
      {insights.map((insight) => {
        const content = (
          <>
            <span className="insight-ico">{insight.icon}</span>
            <span className="insight-text">
              {insight.segments.map((seg, i) => (seg.bold ? <b key={i}>{seg.text}</b> : <span key={i}>{seg.text}</span>))}
            </span>
          </>
        )
        return insight.link ? (
          <Link key={insight.id} to={insight.link} className={`insight ${insight.severity}`}>
            {content}
          </Link>
        ) : (
          <div key={insight.id} className={`insight ${insight.severity}`}>
            {content}
          </div>
        )
      })}
    </>
  )
}
