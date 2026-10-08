import type { SVGProps } from 'react'

export default function HomepageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={34} height={34} viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <circle cx={39} cy={25} r={23} fill="#6895ee" />
      <circle cx={25} cy={39} r={23} fill="#8860d6" fillOpacity={0.9} />
    </svg>
  )
}
