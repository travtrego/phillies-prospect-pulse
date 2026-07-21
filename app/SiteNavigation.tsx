'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links=[
 {href:'/',label:'Dashboard'},
 {href:'/rankings',label:'Rankings'},
 {href:'/affiliates',label:'Affiliates'},
 {href:'/news',label:'News'},
 {href:'/promotions',label:'Promotions'},
 {href:'/injuries',label:'Injuries'},
 {href:'/prospect-genie',label:'Genie'}
];

export default function SiteNavigation(){
 const pathname=usePathname();
 return <nav className="topNav" aria-label="Main navigation">
  <div className="navInner">
   <Link className="navBrand" href="/"><span>Prospect</span> Pulse</Link>
   <div className="navLinks">
    {links.map(link=>{const active=link.href==='/'?pathname===link.href:pathname.startsWith(link.href);return <Link key={link.href} className={active?'navActive':''} href={link.href}>{link.label}</Link>})}
   </div>
  </div>
 </nav>;
}
