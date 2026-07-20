'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

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
 const[open,setOpen]=useState(false);
 return <nav className="topNav" aria-label="Main navigation">
  <div className="navInner">
   <Link className="navBrand" href="/" onClick={()=>setOpen(false)}><span>Prospect</span> Pulse</Link>
   <button className="navToggle" type="button" aria-expanded={open} aria-controls="primary-navigation" onClick={()=>setOpen(value=>!value)}><span/><span/><span/><b>Menu</b></button>
   <div id="primary-navigation" className={`navLinks ${open?'navOpen':''}`}>
    {links.map(link=>{const active=link.href==='/'?pathname===link.href:pathname.startsWith(link.href);return <Link key={link.href} className={active?'navActive':''} href={link.href} onClick={()=>setOpen(false)}>{link.label}</Link>})}
   </div>
  </div>
 </nav>;
}
