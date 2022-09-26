import {
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  QueryConstraint,
  startAfter,
  where
} from "firebase/firestore"
import { useEffect, useMemo } from "react"
import { firestore } from "../../firebase"
import { currentGeneralCourt, nullableQuery } from "../common"
import { createTableHook } from "../createTableHook"
import { Testimony, TestimonySearchRecord } from "./types"
import { createClient } from "../../../components/search/common"
import { log } from "console"

type Refinement = {
  senatorId?: string
  representativeId?: string
  uid?: string
  billId?: string
  profilePage?: boolean
}

const initialRefinement = (
  uid?: string,
  billId?: string,
): Refinement => ({
  representativeId: undefined,
  senatorId: undefined,
  uid,
  billId,
})

const useTable = createTableHook<Testimony, Refinement, unknown>({
  getPageKey: i => i.publishedAt,
  getItems: listTestimony,
  name: "published testimony"
})

export type TestimonyFilterOptions =
  | { representativeId: string }
  | { senatorId: string }

export type UsePublishedTestimonyListing = ReturnType<
  typeof usePublishedTestimonyListing
>
export function usePublishedTestimonyListing({
  uid,
  billId,
}: {
  uid?: string
  billId?: string
} = {}) {
  const { pagination, items, refine, refinement } = useTable(
    initialRefinement(uid, billId)
  )

  useEffect(() => {
    if (refinement.uid !== uid) refine({ uid })
    if (refinement.billId !== billId) refine({ billId })
  }, [billId, refine, refinement, uid])

  return useMemo(
    () => ({
      pagination,
      setFilter: (r: TestimonyFilterOptions | null) =>
        refine({
          representativeId: undefined,
          senatorId: undefined,
          ...r
        }),
      items
    }),
    [pagination, items, refine]
  )
}

function getWhere({
  uid,
  billId,
  representativeId,
  senatorId
}: Refinement): QueryConstraint[] {
  const constraints: Parameters<typeof where>[] = []
  if (uid) constraints.push(["authorUid", "==", uid])
  if (billId) constraints.push(["billId", "==", billId])
  if (representativeId)
    constraints.push(["representativeId", "==", representativeId])
  if (senatorId) constraints.push(["senatorId", "==", senatorId])
  return constraints.map(c => where(...c))
}

async function listTestimony(
  refinement: Refinement,
  limitCount: number,
  startAfterKey: unknown | null
): Promise<Testimony[]> {
  const client = createClient()
  const testimonyRef = collectionGroup(firestore, "publishedTestimony")
  let query = { q: "*", query_by: "billId" }

  console.log('List Testimony', {
    refinement,
    testimonyRef,
    getWhere: {...getWhere(refinement)},
    currentGeneralCourt,
    orderBy: orderBy("publishedAt", "desc"),
    limit: limit(limitCount),
    startAfterKey
  })

  if (refinement.billId)
    query = {
      q: refinement.billId,
      query_by: "billId"
    }

  const data = await client
    .collections("publishedTestimony")
    .documents()
    .search(query)

  return data.hits
    ? data.hits.map(({ document } : { document: any }) => { 
      return {
        ...document,
        publishedAt: document.publishedAt
      } as TestimonySearchRecord
    }) : []


  const result = await getDocs(
    nullableQuery(
      testimonyRef,
      ...getWhere(refinement),
      where("court", "==", currentGeneralCourt),
      orderBy("publishedAt", "desc"),
      limit(limitCount),
      startAfterKey !== null && startAfter(startAfterKey)
    )
  )

  return result.docs.map(d => d.data() as Testimony)
}
