import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Outlet, useCatch, useLoaderData, useParams } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { prisma } from '~/db.server'
import { requireUserId } from '~/services/auth.server'

export async function loader({ request, params }: LoaderArgs) {
	invariant(params.bookingId, 'Missing bookingId')
	const userId = await requireUserId(request)
	const booking = await prisma.booking.findFirst({
		where: {
			AND: [
				{ id: params.bookingId },
				{
					OR: [{ renterId: userId }, { ship: { hostId: userId } }],
				},
			],
		},
		select: {
			id: true,
			shipId: true,
			totalPrice: true,
			startDate: true,
			endDate: true,
		},
	})

	if (!booking) {
		throw new Response('not found', { status: 404 })
	}

	// you can only review a booking if:
	// 1. the endDate has past
	// 2. there's no review yet
	// 3. it's over two weeks past the endDate
	const canReview =
		booking.endDate.getTime() < Date.now() &&
		!booking.review &&
		booking.endDate.getTime() + 1000 * 60 * 60 * 24 * 14 < Date.now()

	return json({ booking })
}

export default function BookingRoute() {
	const data = useLoaderData<typeof loader>()
	return (
		<div>
			<h2>Booking</h2>
			<pre>{JSON.stringify(data, null, 2)}</pre>
			<hr />
			<Outlet />
		</div>
	)
}

export function CatchBoundary() {
	const caught = useCatch()
	const params = useParams()

	if (caught.status === 404) {
		return <div>Booking "{params.starportId}" not found</div>
	}

	throw new Error(`Unexpected caught response with status: ${caught.status}`)
}
