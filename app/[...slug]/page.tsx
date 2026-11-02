import { CampusFixRouter } from "@/components/campus-fix/campus-fix-router"
import { requireUser } from "@/lib/auth/authorization"
import { routePolicy } from "@/lib/auth/policy"

type CatchAllPageProps = {
  params: Promise<{ slug: string[] }>
}

export default async function CatchAllPage({ params }: CatchAllPageProps) {
  const { slug } = await params
  const route = `/${slug.join("/")}`
  const roles = routePolicy(route)
  if (roles) await requireUser(roles)
  return <CampusFixRouter route={route} />
}
